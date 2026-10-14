#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HaegyoInteractable.h"
#include "HaegyoDoor.generated.h"

// 교실 미닫이문 · 여닫이문. 고정 GUID 로 저장/복원 (웹 saveSystem 의 uid 와 같은 역할)
UCLASS()
class HAEGYOUE_API AHaegyoDoor : public AActor, public IHaegyoInteractable
{
	GENERATED_BODY()
public:
	AHaegyoDoor();
	virtual void Tick(float DeltaSeconds) override;
	virtual void OnConstruction(const FTransform& Transform) override;
	virtual void Interact_Implementation(AActor* InstigatorActor) override;
	virtual FText GetPrompt_Implementation() const override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Haegyo") UStaticMeshComponent* Panel;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Haegyo") bool bSliding = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Haegyo") bool bLocked = false;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Haegyo") float Open = 0.f;     // 0 닫힘 ~ 1 열림
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Haegyo") float Target = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Haegyo") float SlideDistance = 98.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Haegyo") float HingeAngle = 90.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Haegyo") FGuid DoorId;
	UPROPERTY(EditAnywhere, Category = "Haegyo") FText DoorName = FText::FromString(TEXT("문"));
	void Apply();   // 열림 정도를 패널 위치/회전에 반영
};
